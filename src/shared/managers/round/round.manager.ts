import { Logger } from '@shared';
import { Database } from 'firebase-admin/database';

import { Answer, Round } from '.';

export class RoundManager {
    constructor(private readonly database: Database) {}

    private readonly logger = new Logger('RoundManager');

    private readonly answers = 'answers';
    private readonly rounds = 'rounds';

    async createAnswer(answer: Answer): Promise<void> {
        const ref = this.database
            .ref(this.answers)
            .child(answer.game_id)
            .child(answer.for_round_index.toString())
            .child(answer.player_token);

        this.logger.info('createAnswer', { answer });

        await ref.set({
            ...answer,
            answer_time: answer.answer_time.toISOString(),
        });
    }

    async getUserAnswer(gameId: string, roundIndex: number, playerToken: string): Promise<Answer | null> {
        const answerRef = this.database.ref(this.answers).child(gameId).child(roundIndex.toString()).child(playerToken);
        const snapshot = await answerRef.get();
        if (!snapshot.exists()) {
            return null;
        }

        const parsed = this.parseAnswer(snapshot.val() as Answer);

        this.logger.info('getUserAnswer', { answer: parsed });

        return parsed;
    }

    async getRoundAnswers(gameId: string, roundIndex: number): Promise<Answer[] | null> {
        const answersRef = this.database.ref(this.answers).child(gameId).child(roundIndex.toString());
        const snapshot = await answersRef.get();
        if (!snapshot.exists()) {
            this.logger.warning('getRoundAnswers, snapshot does not exist', {
                gameId,
                roundIndex,
            });

            return null;
        }

        const answers: Answer[] = [];
        snapshot.forEach((child) => {
            answers.push(this.parseAnswer(child.val() as Answer));
        });

        this.logger.info('getRoundAnswers', { answers });

        return answers;
    }

    async getAnswersForPlayer(gameId: string, playerToken: string): Promise<Answer[]> {
        const answersRef = this.database.ref(this.answers).child(gameId);
        const snapshot = await answersRef.get();
        if (!snapshot.exists()) {
            this.logger.warning('getAnswersForPlayer, snapshot does not exist', {
                gameId,
                playerToken,
            });

            return [];
        }

        const answers: Answer[] = [];
        snapshot.forEach((child) => {
            child.forEach((answerSnapshot) => {
                const answer = answerSnapshot.val();
                if (answer.player_token !== playerToken) {
                    return;
                }

                const parsedAnswer = this.parseAnswer(answer as Answer);
                answers.push(parsedAnswer);
            });
        });

        this.logger.info('getAnswersForPlayer', { answers });

        return answers;
    }

    async createRound(round: Round): Promise<void> {
        const ref = this.database.ref(this.rounds).child(round.game_id).child(round.round_index.toString());

        this.logger.info('createRound', { round });

        await ref.set({
            ...round,
            started_at: round.started_at.toISOString(),
        });
    }

    async getRoundsForGame(gameId: string): Promise<Round[]> {
        const roundRef = this.database.ref(this.rounds).child(gameId);
        const snapshot = await roundRef.get();
        if (!snapshot.exists()) {
            this.logger.warning('getRoundsForGame, snapshot does not exist', {
                gameId,
            });

            return [];
        }

        const parsedRounds: Round[] = [];
        snapshot.forEach((roundSnapshot) => {
            const round = this.parseRound(roundSnapshot.val());

            parsedRounds.push(round);
        });

        this.logger.info('getRoundsForGame', { rounds: parsedRounds });

        return parsedRounds;
    }

    async getLastRoundForGame(gameId: string): Promise<Round | null> {
        const roundRef = this.database.ref(this.rounds).child(gameId);
        const snapshot = await roundRef.get();
        if (!snapshot.exists()) {
            this.logger.warning('getLastRoundForGame, snapshot does not exist', {
                gameId,
            });

            return null;
        }

        const roundIndexes = Object.keys(snapshot.val()).map((index) => parseInt(index, 10));
        const lastRoundIndex = Math.max(...roundIndexes);
        const lastRound = snapshot.val()[lastRoundIndex];

        this.logger.info('getLastRoundForGame', { lastRound });

        return this.parseRound(lastRound as Round);
    }

    async finishRound(round: Round, correctAnswerIndex: number): Promise<void> {
        const roundRef = this.database.ref(this.rounds).child(round.game_id).child(round.round_index.toString());

        this.logger.info('finishRound', { round, correctAnswerIndex });

        await roundRef.update({
            is_finished: true,
            correct_answer_index: correctAnswerIndex,
        });
    }

    private parseAnswer(answer: Answer): Answer {
        return {
            game_id: answer.game_id,
            for_round_index: answer.for_round_index,
            player_token: answer.player_token,
            was_hint_used: answer.was_hint_used,
            answer_index: answer.answer_index,
            answer_time: new Date(answer.answer_time),
        };
    }

    private parseRound(round: Round): Round {
        return {
            game_id: round.game_id,
            round_index: round.round_index,
            started_at: new Date(round.started_at),
            time_in_seconds: round.time_in_seconds,
            is_hardcore: round.is_hardcore,
            is_finished: round.is_finished,
            correct_answer_index: round.correct_answer_index,
        };
    }
}
