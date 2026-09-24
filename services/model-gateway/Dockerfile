# Adapted for Wikiplane in 2026 from Safeplane model-gateway (Apache-2.0).
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
COPY src /app/src
RUN pip install --no-cache-dir .
ENV PYTHONPATH=/app/src
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"
CMD ["uvicorn", "model_gateway.main:app", "--host", "0.0.0.0", "--port", "8000"]
