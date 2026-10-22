// An exception thrown in the inspected page, e.g. when the page isn't a Nuxt app.
// message is the first line of the description, for the UI; details keeps the stack trace, for the console
export class PageEvalError extends Error {
    constructor(exceptionInfo) {
        const description = exceptionInfo.description || String(exceptionInfo.value || 'Evaluation in the inspected page failed');
        super(description.split('\n')[0]);
        this.name = 'PageEvalError';
        this.details = description;
        this.exceptionInfo = exceptionInfo;
    }
}

/**
 * Runs a self-contained function in the inspected page and resolves with its JSON-serializable result.
 * The function is wrapped into a call expression, so its declarations never leak into the page's
 * global scope and repeated runs don't clash. Rejects with PageEvalError if the page throws.
 */
export function evalInPage(fn, ...args) {
    const expression = `JSON.stringify((${fn})(...${JSON.stringify(args)}))`;

    return new Promise((resolve, reject) => {
        chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
            if (exceptionInfo) {
                reject(new PageEvalError(exceptionInfo));

                return;
            }

            // JSON.stringify(undefined) yields undefined, not a string
            resolve(result === undefined ? undefined : JSON.parse(result));
        });
    });
}
