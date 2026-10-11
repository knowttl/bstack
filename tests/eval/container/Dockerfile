FROM node:24.17.0-bookworm-slim@sha256:5d33add4a73ccf344c582ccb0cf5c7adb26596b3e82e9cfc859e75febc7843c4 AS git-build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gcc make libssl-dev libcurl4-openssl-dev libexpat1-dev zlib1g-dev xz-utils
RUN curl --fail --location https://www.kernel.org/pub/software/scm/git/git-2.54.0.tar.xz --output /tmp/git.tar.xz \
    && tar -xJf /tmp/git.tar.xz -C /tmp \
    && make -C /tmp/git-2.54.0 -j2 prefix=/opt/git NO_GETTEXT=YesPlease NO_TCLTK=YesPlease all install

FROM node:24.17.0-bookworm-slim@sha256:5d33add4a73ccf344c582ccb0cf5c7adb26596b3e82e9cfc859e75febc7843c4
LABEL org.bstack.evaluation="disposable-toolchain"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libcurl4 libexpat1 python3 procps ripgrep \
    && rm -rf /var/lib/apt/lists/*
COPY --from=git-build /opt/git /opt/git
ENV PATH="/opt/git/bin:${PATH}"
RUN npm install --global npm@11.13.0 @openai/codex@0.162.1 \
    && npm cache clean --force \
    && node --version && npm --version && git --version && codex --version
