-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_expiresAt_idx"
ON "RefreshToken"("userId", "revokedAt", "expiresAt");