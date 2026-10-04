export function bindStepKeys(options: {
  isActive(): boolean; canAdvance(): boolean; advance(): void; nextButton(): HTMLButtonElement; root?: Document;
}): () => void;
