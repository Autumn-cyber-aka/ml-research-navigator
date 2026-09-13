"""Hosting boundary checks: trusted proxy and verified TLS configuration."""
import ssl
from unittest.mock import patch

from navigator import create_app
from navigator.db import connect


def test_forwarded_https_only_when_explicitly_trusted(app):
    base = dict(app.config)
    for trusted in (False, True):
        deployed = create_app({**base, "TRUST_PROXY": trusted, "SESSION_COOKIE_SECURE": True})

        @deployed.get("/test-proxy")
        def scheme():
            from flask import request
            return {"secure": request.is_secure, "host": request.host}

        response = deployed.test_client().get("/test-proxy", headers={
            "X-Forwarded-Proto": "https", "X-Forwarded-Host": "untrusted.example",
        })
        assert response.json == {"secure": trusted, "host": "localhost"}
        assert "max-age=" in response.headers["Strict-Transport-Security"]


def test_cloud_tls_keeps_hostname_and_certificate_verification(app):
    context = ssl.create_default_context()
    with patch("navigator.db.ssl.create_default_context", return_value=context) as factory, \
            patch("navigator.db.pymysql.connect") as mysql:
        connect({**app.config, "MYSQL_SSL_CA": "/etc/secrets/mysql-ca.pem"})
    factory.assert_called_once_with(cafile="/etc/secrets/mysql-ca.pem")
    assert mysql.call_args.kwargs["ssl"] is context
    assert context.check_hostname is True
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.minimum_version >= ssl.TLSVersion.TLSv1_2
