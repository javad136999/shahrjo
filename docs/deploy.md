# Deploy — ShahrJo (VPS + GitHub)

اجرا: از ریشه ریپو، مطابق ترتیب زیر. همه Secretها فقط در `.env` سرور هستند (هرگز در Git).

## ۰) پیش‌نیازها (یک بار)

1. **DNS**: رکورد A دامنه (مثلاً `shahrju.ir` و `@`) → IP سرور.
2. **کلید SSH**: کلید عمومی خود را به سرور اضافه کنید:
   ```bash
   ssh-copy-id deploy@SERVER_IP        # یا دستی:
   # echo '<YOUR_PUBLIC_KEY>' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
   ```
3. **Docker** روی سرور (در صورت نبود):
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker deploy   # لاگاوت/لوگین
   ```

## ۱) GitHub

```bash
# سمت شما: یک Repository خالی بسازید و آدرسش را بدهید
git remote add origin git@github.com:USER/shahrjo.git
git push -u origin main
```

## ۲) اولین deploy روی سرور

```bash
ssh deploy@SERVER_IP
git clone git@github.com:USER/shahrjo.git /home/deploy/shahrjo
cd /home/deploy/shahrjo

cp .env.example .env
# .env را ویرایش کنید: رمزهای قوی بسازید:
#   openssl rand -base64 48   (برای POSTGRES_PASSWORD, JWT_*, OTP_HASH_SECRET)
#   SERVER_NAME را روی دامنه بگذارید
nano .env

pnpm check:env 2>/dev/null || node scripts/check-env.mjs

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec api npx prisma db seed   # فقط بار اول

docker compose -f docker-compose.prod.yml ps    # همه باید healthy باشند
curl -s http://127.0.0.1/api/v1/health
```

## ۳) SSL (Let's Encrypt) — بعد از ست شدن DNS

```bash
docker run --rm \
  -v shahrjo-prod_certs:/etc/letsencrypt \
  -v shahrjo-prod_www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d shahrju.ir -d www.shahrju.ir --agree-tos -m you@example.com
```
سپس در `docker/nginx/templates/default.conf.template` بلوک TLS (پایین فایل) را فعال و
در `docker-compose.prod.yml` پورت‌های `443` و mount های certbot را باز کنید.

## ۴) آپدیت بعدی

```bash
cd /home/deploy/shahrjo
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

## ۵) بکاپ

- سرویس `backup` هر روز ساعت ۰۳:۰۰ (تهران) با `pg_dump` بکاپ می‌گیرد.
- فایل‌ها در ولوم `shahrjo-prod_backups`، نگهداری پیش‌فرض ۷ نسخه (`BACKUP_KEEP`).
- بازیابی: `zcat backup.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB`

## نکات امنیتی

- Postgres/Redis هیچ پورتی به بیرون ندارند (فقط شبکه compose).
- Nginx تنها درگاه 80 (و 443 بعد از SSL) را باز می‌کند.
- `.env` سرور هرگز commit/push نمی‌شود (`.gitignore` + `.dockerignore`).
- Merchant زرین‌پال و API Key پیامک فقط در `.env` سرور.
