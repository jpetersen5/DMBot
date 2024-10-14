FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY .env.dev ./
# COPY app/migrations/data/songs_with_md5.json ./app/migrations/data/songs_with_md5.json
EXPOSE 5000
ENV FLASK_APP=run.py
ENV FLASK_ENV=development

CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "-b", "0.0.0.0:5000", "run:app"]