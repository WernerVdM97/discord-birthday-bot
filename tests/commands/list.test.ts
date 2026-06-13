import { describe, it, expect, beforeEach } from "vitest";
import { handleList } from "../../src/commands/list.js";
import { initDb, upsertBirthday } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
	initDb(":memory:");
});

describe("handleList", () => {
	it("lists all birthdays with clickable user mentions", async () => {
		upsertBirthday("u1", "Alice", "03-14");
		upsertBirthday("u2", "Bob", "12-25");

		const interaction = mockInteraction();

		await handleList(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("<@u1>"),
				ephemeral: true,
			}),
		);
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("<@u2>"),
				ephemeral: true,
			}),
		);
	});

	it("returns empty message when no birthdays", async () => {
		const interaction = mockInteraction();

		await handleList(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "No birthdays stored yet.",
				ephemeral: true,
			}),
		);
	});
});
