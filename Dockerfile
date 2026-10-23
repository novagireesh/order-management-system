FROM python:3.12-slim
WORKDIR /app
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ /app/
ENV OMS_DATA_DIR=/data OMS_NO_BROWSER=1 OMS_HOST=0.0.0.0 OMS_PORT=8765 PYTHONUNBUFFERED=1
EXPOSE 8765
CMD ["python", "server.py"]
