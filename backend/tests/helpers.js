// Resposta Express mínima para testar middlewares sem servidor HTTP.
export function fakeRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

// Corre um middleware e devolve a resposta e se o next() foi chamado.
export function runMiddleware(middleware, req = {}) {
    const res = fakeRes();
    let nextCalled = false;
    middleware({ path: '/teste', ...req }, res, () => {
        nextCalled = true;
    });
    return { res, nextCalled };
}
