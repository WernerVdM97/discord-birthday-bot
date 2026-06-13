import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleNext } from "../../src/commands/next.js";
import { initDb, upsertBirthday } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
	initDb(":memory:");
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("handleNext", () => {
	it("shows the next birthday with clickable user mention", async () => {
		vi.setSystemTime(new Date(2026, 0, 1)); // January 1

		upsertBirthday("u1", "Alice", "01-15");

		const interaction = mockInteraction();
		await handleNext(interaction);

		const call = (interaction.reply as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		expect(call.content).toContain("<@u1>");
	});

	it('shows "Today!" when birthday is today', async () => {
		vi.setSystemTime(new Date(2026, 5, 14)); // June 14

		upsertBirthday("u1", "Alice", "06-14");

		const interaction = mockInteraction();
		await handleNext(interaction);

		const call = (interaction.reply as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		expect(call.content).toContain("Today!");
	});

	it('shows "Tomorrow" when birthday is the next day', async () => {
		vi.setSystemTime(new Date(2026, 5, 13)); // June 13

		upsertBirthday("u1", "Alice", "06-14");

		const interaction = mockInteraction();
		await handleNext(interaction);

		const call = (interaction.reply as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		expect(call.content).toContain("Tomorrow");
	});

	it("shows days until when birthday is further away", async () => {
		vi.setSystemTime(new Date(2026, 0, 1)); // January 1

		upsertBirthday("u1", "Alice", "01-15");

		const interaction = mockInteraction();
		await handleNext(interaction);

		const call = (interaction.reply as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		expect(call.content).toContain("in 14 days");
	});

	it("shows count when multiple birthdays fall on the same day", async () => {
		vi.setSystemTime(new Date(2026, 0, 1)); // January 1

		upsertBirthday("u1", "Alice", "01-15");
		upsertBirthday("u2", "Bob", "01-15");

		const interaction = mockInteraction();
		await handleNext(interaction);

		const call = (interaction.reply as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		expect(call.content).toContain("2 birthdays on this day");
	});

	it("returns empty message when no birthdays stored", async () => {
		const interaction = mockInteraction();

		await handleNext(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "No birthdays stored yet.",
				ephemeral: true,
			}),
		);
	});
});
