
export function calibrationError(predictions: number[], outcomes: number[]) {

  let error = 0;

  for (let i = 0; i < predictions.length; i++) {
    error += Math.abs(predictions[i] - outcomes[i]);
  }

  return error / predictions.length;
}