export function shotsModel(expectedShots: number) {

  if (!expectedShots || isNaN(expectedShots)) {
    expectedShots = 20;
  }

  expectedShots = Math.max(10, Math.min(35, expectedShots));

  return {
    expected: expectedShots,

    over15_5: expectedShots > 15.5,
    over18_5: expectedShots > 18.5,
    over21_5: expectedShots > 21.5,

    under15_5: expectedShots < 15.5,
    under18_5: expectedShots < 18.5,
    under21_5: expectedShots < 21.5
  };
}