FROM postgres:15

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential postgresql-server-dev-15 curl make gcc ca-certificates \
    && curl -L -o /tmp/pgvector.tar.gz https://codeload.github.com/pgvector/pgvector/tar.gz/main \
    && mkdir -p /tmp/pgvector && tar -xzf /tmp/pgvector.tar.gz -C /tmp/pgvector --strip-components=1 \
    && cd /tmp/pgvector \
    && make && make install \
    && rm -rf /tmp/pgvector /tmp/pgvector.tar.gz \
    && apt-get remove -y curl make gcc \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
