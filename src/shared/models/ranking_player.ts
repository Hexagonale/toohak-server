import { z } from 'zod';

export const rankingPlayer = z.object({
    token: z.string().min(1),
    username: z.string().min(1),
    points: z.number().int().min(0),
    round_lost: z.number().int().min(0).nullable().default(null),
});

export type RankingPlayer = z.infer<typeof rankingPlayer>;
