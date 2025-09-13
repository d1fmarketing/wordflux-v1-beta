# AWS Permanent Access Hardening

This document captures the steps applied to make the deployment permanent and publicly accessible, plus what remains for HTTPS + domain.

## Result

- Elastic IP allocated and associated to the instance
- Public URL (no auth):
  - App: `http://52.4.68.118`
  - Dashboard: `http://52.4.68.118/dashboard`
  - Health: `http://52.4.68.118/api/health`

## What was done

- Installed and configured Nginx reverse proxy (`/etc/nginx/sites-enabled/wordflux`)
- Ensured PM2 apps run persistently (`wordflux-test`, `wordflux-realtime`)
- Allocated and associated Elastic IP via AWS CLI:

```bash
REGION=$(curl -s --retry 3 -H "X-aws-ec2-metadata-token: $(curl -s -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')" \
  http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)
IID=$(curl -s -H "X-aws-ec2-metadata-token: $(curl -s -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')" \
  http://169.254.169.254/latest/meta-data/instance-id)
ALLOC_ID=$(aws ec2 allocate-address --domain vpc --region "$REGION" --query AllocationId --output text)
aws ec2 associate-address --instance-id "$IID" --allocation-id "$ALLOC_ID" --region "$REGION"
```

## Next: Domain + HTTPS

1) Choose a domain (Route 53 or your DNS)
- Create A record pointing to `52.4.68.118` (Elastic IP)

2) Install TLS with Let’s Encrypt

```bash
sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Auto-renewal is installed by default via systemd timer
```

3) Update runtime env (optional)

Set these and restart PM2 to ensure consistent URLs client-side:

```bash
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_WS_URL=wss://yourdomain.com/socket.io/
```

4) Confirm

```bash
curl -I https://yourdomain.com
curl -s https://yourdomain.com/api/health | jq
```

## Notes

- If you later rebuild or restart, PM2 and Nginx persist; the Elastic IP keeps the same address.
- If you replace the EC2 instance, you can re-associate the same Elastic IP to the new instance.

