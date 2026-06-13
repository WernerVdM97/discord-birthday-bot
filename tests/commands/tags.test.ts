import { describe, it, expect, beforeEach } from "vitest";
import { handleTags } from "../../src/commands/tags.js";
import { initDb, addTag } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
	initDb(":memory:");
});

describe("handleTags", () => {
	it("shows tags with clickable user mention", async () => {
		addTag("u1", "admin", "manual");
		addTag("u1", "memelord", "manual");

		const interaction = mockInteraction({
			user: { id: "u1", displayName: "Alice" },
		});

		await handleTags(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("<@u1>"),
				ephemeral: true,
			}),
		);
	});

	it("uses mention in the no-tags message", async () => {
		const interaction = mockInteraction({
			user: { id: "u2", displayName: "Bob" },
		});

		await handleTags(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("<@u2>"),
				ephemeral: true,
			}),
		);
	});
});
