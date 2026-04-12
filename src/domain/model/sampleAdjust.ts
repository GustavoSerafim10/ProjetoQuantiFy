export function applySampleAdjustment( 
    value:number, 
    sampleSize:number,
    leagueAvg: number
): number {

    const weight = sampleSize / (sampleSize +8);

    return ( value * weight) + (leagueAvg * (1 -weight));
}