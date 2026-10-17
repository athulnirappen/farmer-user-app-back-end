// Shown to the farmer and accepted on every product add and update.
// Change `version` whenever the text changes, so farmers must accept the new wording.
export const PRODUCT_DECLARATION = {
  version: '2026-10-17',
  text:
    'I confirm that the details of this product are accurate and that it is safe and fit for ' +
    'its intended use, and complies with applicable food-safety and labelling laws. I accept ' +
    'full responsibility for any harm, loss or damage caused by this product, and agree to ' +
    'compensate the platform for any claim arising from it.',
} as const;
