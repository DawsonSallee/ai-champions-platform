"use server";

import { z } from "zod";
import { defineAction } from "@/lib/action";
import { answerQuestion } from "./faq";

const AskInput = z.object({
  question: z.string().min(1).max(500),
});

export const askConciergeAction = defineAction(AskInput, async ({ input }) => {
  return answerQuestion(input.question);
});
