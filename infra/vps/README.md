# Hesap VPS Backup Worker

Bu klasor, production yedekleme mimarisinin sunucu tarafini belgeler.

Canli kurulumda VPS su isleri yapar:

- Supabase PostgreSQL icin `pg_dump` alir.
- Dump dosyasini Cloudflare R2 bucket'ina yukler.
- Ayni dump icinden `public` uygulama semasini lokal PostgreSQL failover veritabanina restore eder.
- `systemd` timer ile her 6 saatte bir otomatik calisir.
- `/usr/local/bin/hesap-health` ile PostgreSQL, R2 ve son backup durumunu JSON olarak verir.

## Sunucu Dosyalari

| Dosya | Sunucudaki hedef |
| --- | --- |
| `hesap-backup.sh` | `/usr/local/bin/hesap-backup` |
| `hesap-health.sh` | `/usr/local/bin/hesap-health` |
| `hesap-standby-prelude.sql` | `/usr/local/share/hesap-standby-prelude.sql` |

## Secret Dosyalari

Secret dosyalari repoya girmez.

Sunucuda:

- `/etc/hesap/backup.env`
- `/etc/hesap/server.env`

Yerelde:

- `.secrets/hesap-vps.env`

Bu dosyalarda R2 keyleri, Supabase PostgreSQL URL'i ve failover PostgreSQL URL'i tutulur.

## Kurulu Production Sunucu

Mevcut kurulum:

- OS: Ubuntu 24.04 LTS
- PostgreSQL: 17
- Backup araligi: 6 saat
- Backup saklama: 30 gun lokal, R2 uzerinde manuel/lifecycle ile yonetilir
- R2 bucket: `hesap-backups`
- SSH: password login kapali, key login acik
- Firewall: OpenSSH ve PostgreSQL 5432 acik
- Fail2ban: aktif

## Manuel Kontrol

```bash
sudo /usr/local/bin/hesap-health
sudo systemctl status hesap-backup.timer
sudo systemctl start hesap-backup.service
sudo tail -n 80 /var/log/hesap/backup.log
```

## Failover Mantigi

Normalde ana sistem Supabase uzerinden calisir. Supabase uzun sureli ariza verirse:

1. Developer sistem sagligi ekranindan failover DB durumunu kontrol eder.
2. Vercel `DATABASE_URL`/`DIRECT_URL` gecici olarak `FAILOVER_DATABASE_URL` degerine alinabilir.
3. Son basarili backup zamanina kadar olan veriler yedek PostgreSQL uzerinden okunabilir.
4. Supabase geri geldiginde elle geri donus ve veri karsilastirma yapilir.

Tam otomatik failover bilincli olarak acik degildir; veri cakismazligi riskini azaltmak icin developer onayi gerekir.
