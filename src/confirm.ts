import { App, Modal, Setting } from 'obsidian';

/** Texts of a confirmation window; the caller passes them already translated. */
export interface ConfirmTexts {
    title: string;
    message: string;
    confirm: string;
    cancel: string;
}

/**
 * A question before work that touches many notes at once.
 *
 * Obsidian's own `Modal` gives the native look and keyboard behaviour, and the
 * answer comes back as a promise, so the caller reads as a single line.
 */
class ConfirmModal extends Modal {
    private answered = false;

    constructor(
        app: App,
        private texts: ConfirmTexts,
        private answer: (confirmed: boolean) => void,
    ) {
        super(app);
    }

    onOpen(): void {
        this.titleEl.setText(this.texts.title);
        this.contentEl.createEl('p', { text: this.texts.message });
        new Setting(this.contentEl)
            .addButton(button => button
                .setButtonText(this.texts.cancel)
                .onClick(() => this.finish(false)))
            .addButton(button => button
                .setCta()
                .setButtonText(this.texts.confirm)
                .onClick(() => this.finish(true)));
    }

    onClose(): void {
        this.contentEl.empty();
        // Closed without pressing a button (Esc, click outside) — that is a "no".
        if (!this.answered) {
            this.answered = true;
            this.answer(false);
        }
    }

    private finish(confirmed: boolean): void {
        if (this.answered) return;
        this.answered = true;
        this.answer(confirmed);
        this.close();
    }
}

/** Asks the user and resolves with the answer. */
export function confirmAction(app: App, texts: ConfirmTexts): Promise<boolean> {
    return new Promise(resolve => {
        new ConfirmModal(app, texts, resolve).open();
    });
}
