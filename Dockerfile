FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home --uid 10001 navigator
COPY --chown=navigator:navigator navigator ./navigator
COPY --chown=navigator:navigator sql ./sql
USER navigator
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--access-logfile", "-", "navigator:create_app()"]

FROM base AS test
USER root
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY --chown=navigator:navigator tests ./tests
COPY --chown=navigator:navigator scripts ./scripts
COPY --chown=navigator:navigator pyproject.toml ./
RUN mkdir -p /app/docs/evidence && chown -R navigator:navigator /app
USER navigator
CMD ["python", "-m", "pytest", "--cov=navigator", "--cov-report=term-missing", "-q"]
