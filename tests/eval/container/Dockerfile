FROM ghcr.io/astral-sh/uv:0.12.22@sha256:0f1da8ef29dfee2fc8490653fe306c0242e653a160b56278d468997afc65a314 AS uv
FROM node:24.17.0-bookworm-slim@sha256:5d33add4a73ccf344c582ccb0cf5c7adb26596b3e82e9cfc859e75febc7843c4 AS git-build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gcc make libssl-dev libcurl4-openssl-dev libexpat1-dev zlib1g-dev xz-utils
RUN curl --fail --location https://www.kernel.org/pub/software/scm/git/git-2.54.0.tar.xz --output /tmp/git.tar.xz \
    && tar -xJf /tmp/git.tar.xz -C /tmp \
    && make -C /tmp/git-2.54.0 -j2 prefix=/opt/git NO_GETTEXT=YesPlease NO_TCLTK=YesPlease all install

FROM node:24.17.0-bookworm-slim@sha256:5d33add4a73ccf344c582ccb0cf5c7adb26596b3e82e9cfc859e75febc7843c4
LABEL org.bstack.evaluation="disposable-toolchain"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libcurl4 libexpat1 python3 python3-venv procps ripgrep chromium \
    && rm -rf /var/lib/apt/lists/*
COPY --from=git-build /opt/git /opt/git
COPY --from=uv /uv /uvx /usr/local/bin/
ENV PATH="/opt/git/bin:${PATH}"
RUN ln -s /opt/git/bin/git /usr/local/bin/git
RUN mkdir -p /opt/google/chrome && ln -s /usr/bin/chromium /opt/google/chrome/chrome
ENV CHROME_DEVTOOLS_AXI_MCP_PATH="/usr/local/lib/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js"
ENV CHROME_DEVTOOLS_AXI_CHROME_ARGS="--no-sandbox --disable-dev-shm-usage"
RUN npm install --global npm@11.13.0 @openai/codex@0.162.1 lavish-axi@0.1.78 chrome-devtools-axi@0.1.34 chrome-devtools-mcp@1.10.1 \
    && npm cache clean --force \
    && node --version && npm --version && git --version && codex --version
ENV UV_PYTHON_INSTALL_DIR="/opt/python"
RUN uv python install 3.12.15 \
    && UV_CACHE_DIR=/opt/uv-cache uv venv /opt/ruff-env --python 3.12.15 \
    && UV_CACHE_DIR=/opt/uv-cache uv pip install --python /opt/ruff-env/bin/python ruff==0.14.0
ENV UV_PYTHON_DOWNLOADS="never"
