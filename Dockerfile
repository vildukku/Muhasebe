FROM python:3.9-slim

WORKDIR /app

# Copy application files
COPY . /app

# Expose default port
EXPOSE 8080

ENV PORT=8080

CMD ["python3", "run.py", "--host", "0.0.0.0"]
