export interface Round {
    game_id: string;
    round_index: number;
    started_at: Date;
    time_in_seconds: number;
    is_hardcore: boolean;
    is_finished: boolean;
    correct_answer_index?: number;
}
