export interface Answer {
    game_id: string;
    for_round_index: number;
    player_token: string;
    was_hint_used: boolean;
    answer_index: number;
    answer_time: Date;
}
