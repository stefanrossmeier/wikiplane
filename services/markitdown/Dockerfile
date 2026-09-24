FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
COPY src /app/src
RUN pip install --no-cache-dir .
ENV PYTHONPATH=/app/src WORKSPACE_ROOT=/workspace
EXPOSE 8010
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/health', timeout=2)"
CMD ["uvicorn", "markitdown_service.main:app", "--host", "0.0.0.0", "--port", "8010"]
