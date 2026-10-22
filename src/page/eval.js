// An exception thrown in the inspected page, e.g. when the page isn't a Nuxt app
export class PageEvalError extends Error {
    constructor(exceptionInfo) {
        super(exceptionInfo.description || String(exceptionInfo.value || 'Evaluation in the inspected page failed'));
        this.name = 'PageEvalError';
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
