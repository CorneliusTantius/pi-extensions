import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const CONFIG_PATH = join(getAgentDir(), "subagents.json");
const MAX_PARALLEL = 6;
const OUTPUT_LIMIT = 30_000;
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

type ThinkingLevel = (typeof THINKING_LEVELS)[number];

type SubagentConfig = {
	defaultModel?: string;
	defaultThinking?: ThinkingLevel;
	agents: Array<{
		name: string;
		description: string;
		model?: string | null;
		thinking?: ThinkingLevel;
		tools?: string[];
		systemPrompt: string;
	}>;
};

type RunResult = {
	agent: string;
	task: string;
	exitCode: number;
	output: string;
	stderr: string;
	model?: string;
	thinking?: ThinkingLevel;
};

function defaultConfig(): SubagentConfig {
	const defaultModel = "gpt-5.6-luna";

	const base = [
		"You are a small focused grunt-work subagent.",
		"Use low/medium effort, stay concise, and do only the assigned task.",
		"Return findings, changed files, commands run, and any blockers.",
		"Do not start broad refactors or extra work.",
	].join("\n");

	return {
		defaultModel,
		defaultThinking: "low",
		agents: [
			{
				name: "scout",
				description: "Read-only code scout for locating files, APIs, and likely change points.",
				model: defaultModel || null,
				thinking: "low",
				tools: ["read", "grep", "find", "ls"],
				systemPrompt: `${base}\nYou scout the repo and report exact files, symbols, and next steps. Do not edit files.`,
			},
			{
				name: "worker",
				description: "Small implementation worker for boring localized changes.",
				model: defaultModel || null,
				thinking: "low",
				tools: ["read", "edit", "write", "bash", "grep", "find", "ls"],
				systemPrompt: `${base}\nYou implement small localized code changes. Keep edits minimal and obvious.`,
			},
			{
				name: "tester",
				description: "Test runner/debugger for failures, logs, and small fixes.",
				model: defaultModel || null,
				thinking: "low",
				tools: ["read", "bash", "grep", "find", "ls", "edit"],
				systemPrompt: `${base}\nYou run targeted tests, diagnose failures, and suggest or apply small fixes only when asked.`,
			},
			{
				name: "reviewer",
				description: "Read-only reviewer for diffs, risks, and missed edge cases.",
				model: defaultModel || null,
				thinking: "low",
				tools: ["read", "bash", "grep", "find", "ls"],
				systemPrompt: `${base}\nYou review work. Prioritize bugs, regressions, missing tests, and simple fixes. Do not edit files.`,
			},
		],
	};
}

function ensureConfig(): SubagentConfig {
	if (!existsSync(CONFIG_PATH)) {
		writeConfig(defaultConfig());
	}
	return readConfig();
}

function readConfig(): SubagentConfig {
	const raw = readFileSync(CONFIG_PATH, "utf8");
	const config = JSON.parse(raw) as SubagentConfig;
	validateConfig(config);
	return config;
}

function writeConfig(config: SubagentConfig) {
	mkdirSync(dirname(CONFIG_PATH), { recursive: true });
	writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function validateConfig(config: SubagentConfig) {
	if (!config || !Array.isArray(config.agents)) throw new Error("subagents.json must contain an agents array");
	const names = new Set<string>();
	for (const agent of config.agents) {
		if (!agent.name || !agent.description || !agent.systemPrompt) {
			throw new Error("Each subagent needs name, description, and systemPrompt");
		}
		if (names.has(agent.name)) throw new Error(`Duplicate subagent name: ${agent.name}`);
		names.add(agent.name);
		if (agent.thinking && !THINKING_LEVELS.includes(agent.thinking)) {
			throw new Error(`Invalid thinking level for ${agent.name}: ${agent.thinking}`);
		}
	}
	if (config.defaultThinking && !THINKING_LEVELS.includes(config.defaultThinking)) {
		throw new Error(`Invalid defaultThinking: ${config.defaultThinking}`);
	}
}

function truncate(text: string) {
	if (Buffer.byteLength(text, "utf8") <= OUTPUT_LIMIT) return text;
	let out = text.slice(0, OUTPUT_LIMIT);
	while (Buffer.byteLength(out, "utf8") > OUTPUT_LIMIT) out = out.slice(0, -1);
	return `${out}\n\n[truncated: output exceeded ${OUTPUT_LIMIT} bytes]`;
}

function getPiInvocation(args: string[]) {
	const script = process.argv[1];
	if (script && existsSync(script) && !script.startsWith("/$bunfs/root/")) {
		return { command: process.execPath, args: [script, ...args] };
	}
	const runtime = process.execPath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
	if (/^(node|bun)(\.exe)?$/.test(runtime)) return { command: "pi", args };
	return { command: process.execPath, args };
}

async function runSubagent(config: SubagentConfig, agentName: string, task: string, cwd: string, signal?: AbortSignal) {
	const agent = config.agents.find((item) => item.name === agentName);
	if (!agent) {
		const available = config.agents.map((item) => item.name).join(", ") || "none";
		throw new Error(`Unknown subagent "${agentName}". Available: ${available}`);
	}

	const model = agent.model ?? config.defaultModel;
	const thinking = agent.thinking ?? config.defaultThinking ?? "low";
	const prompt = `${agent.systemPrompt}\n\nAssigned task:\n${task}`;
	const args = ["--mode", "json", "--print", "--no-session", "--no-extensions", "--thinking", thinking];
	if (model) args.push("--model", model);
	if (agent.tools?.length) args.push("--tools", agent.tools.join(","));
	args.push(prompt);

	return await new Promise<RunResult>((resolve) => {
		const invocation = getPiInvocation(args);
		const child = spawn(invocation.command, invocation.args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		let finalOutput = "";
		let buffer = "";

		const parseLine = (line: string) => {
			if (!line.trim()) return;
			try {
				const event = JSON.parse(line);
				if (event.type === "message_end" && event.message?.role === "assistant") {
					const text = event.message.content?.find?.((part: any) => part.type === "text")?.text;
					if (text) finalOutput = text;
				}
			} catch {
				stdout += `${line}\n`;
			}
		};

		child.stdout.on("data", (data) => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) parseLine(line);
		});
		child.stderr.on("data", (data) => (stderr += data.toString()));
		child.on("close", (code) => {
			if (buffer) parseLine(buffer);
			resolve({
				agent: agentName,
				task,
				exitCode: code ?? 1,
				output: truncate(finalOutput || stdout.trim() || stderr.trim() || "(no output)"),
				stderr: truncate(stderr.trim()),
				model: model || undefined,
				thinking,
			});
		});
		child.on("error", (error) => {
			resolve({ agent: agentName, task, exitCode: 1, output: error.message, stderr: error.message, model: model || undefined, thinking });
		});
		if (signal) {
			const abort = () => child.kill("SIGTERM");
			if (signal.aborted) abort();
			else signal.addEventListener("abort", abort, { once: true });
		}
	});
}

async function runParallel<T>(items: T[], limit: number, fn: (item: T) => Promise<RunResult>) {
	const results: RunResult[] = [];
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index]);
		}
	});
	await Promise.all(workers);
	return results;
}

function formatResults(results: RunResult[]) {
	return results
		.map((result) => {
			const status = result.exitCode === 0 ? "ok" : `failed (${result.exitCode})`;
			const meta = [result.model, result.thinking && `thinking:${result.thinking}`].filter(Boolean).join(", ");
			return `## ${result.agent} - ${status}${meta ? ` [${meta}]` : ""}\n\n${result.output}${result.stderr && result.exitCode !== 0 ? `\n\nstderr:\n${result.stderr}` : ""}`;
		})
		.join("\n\n---\n\n");
}

const TaskSchema = Type.Object({
	agent: Type.String({ description: "Configured subagent name" }),
	task: Type.String({ description: "Specific task for this subagent" }),
});

export default function subagentsExtension(pi: ExtensionAPI) {
	ensureConfig();

	pi.registerTool({
		name: "spawn_subagents",
		label: "Spawn Subagents",
		description: `Spawn configured low/medium-thinking grunt-work subagents from ${CONFIG_PATH}. Use one agent+task or parallel tasks.`,
		promptSnippet: "Spawn configured subagents for isolated grunt work, scouting, testing, or review.",
		promptGuidelines: [
			"Use spawn_subagents to delegate independent grunt-work tasks to small configured subagents.",
			"Keep spawn_subagents tasks specific and bounded; do not delegate broad planning or vague work.",
		],
		parameters: Type.Object({
			agent: Type.Optional(Type.String({ description: "Subagent name for single mode" })),
			task: Type.Optional(Type.String({ description: "Task for single mode" })),
			tasks: Type.Optional(Type.Array(TaskSchema, { description: "Parallel tasks. Max 6." })),
		}),
		async execute(_id, params, signal, onUpdate, ctx) {
			const config = readConfig();
			const single = params.agent && params.task;
			const batch = params.tasks?.length ? params.tasks : undefined;
			if (Number(Boolean(single)) + Number(Boolean(batch)) !== 1) {
				return { content: [{ type: "text", text: "Provide exactly one mode: agent+task or tasks[]." }] };
			}
			if (batch && batch.length > MAX_PARALLEL) {
				return { content: [{ type: "text", text: `Too many tasks: max ${MAX_PARALLEL}.` }] };
			}

			if (single) {
				onUpdate?.({ content: [{ type: "text", text: `Running ${params.agent}...` }] });
				const result = await runSubagent(config, params.agent!, params.task!, ctx.cwd, signal);
				return { content: [{ type: "text", text: formatResults([result]) }], details: { results: [result] } };
			}

			onUpdate?.({ content: [{ type: "text", text: `Running ${batch!.length} subagents...` }] });
			const results = await runParallel(batch!, 3, (item) => runSubagent(config, item.agent, item.task, ctx.cwd, signal));
			return { content: [{ type: "text", text: formatResults(results) }], details: { results } };
		},
	});

	pi.registerCommand("subagents", {
		description: "List or configure subagents.json",
		getArgumentCompletions(prefix) {
			return ["list", "configure", "reset", "path"]
				.filter((item) => item.startsWith(prefix))
				.map((value) => ({ value, label: value }));
		},
		handler: async (args, ctx) => {
			const action = args.trim() || "list";
			if (action === "path") {
				ctx.ui.notify(CONFIG_PATH.replace(homedir(), "~"), "info");
				return;
			}
			if (action === "reset") {
				if (ctx.hasUI && !(await ctx.ui.confirm("Reset subagents.json?", CONFIG_PATH))) return;
				writeConfig(defaultConfig());
				ctx.ui.notify("subagents.json reset", "info");
				return;
			}
			if (action === "configure" || action === "edit") {
				const current = JSON.stringify(ensureConfig(), null, 2);
				const edited = await ctx.ui.editor("Edit subagents.json", current);
				if (edited === undefined || edited === current) return;
				const parsed = JSON.parse(edited) as SubagentConfig;
				validateConfig(parsed);
				writeFileSync(CONFIG_PATH, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
				ctx.ui.notify("subagents.json saved", "info");
				return;
			}

			const config = ensureConfig();
			const lines = config.agents.map((agent) => {
				const model = agent.model ?? config.defaultModel ?? "pi default";
				const thinking = agent.thinking ?? config.defaultThinking ?? "low";
				return `${agent.name}: ${agent.description} [${model}, thinking:${thinking}]`;
			});
			ctx.ui.notify(`Subagents (${CONFIG_PATH}):\n${lines.join("\n")}`, "info");
		},
	});
}
