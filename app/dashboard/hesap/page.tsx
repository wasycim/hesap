"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Lock, User, CheckCircle, AlertCircle, Shield } from "lucide-react"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { logSecurityEvent } from "@/lib/audit-log"

export default function HesapAyarlariPage() {
  const [email, setEmail] = useState("")
  const [currentEmail, setCurrentEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [emailSaving, setEmailSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const supabase = createClient()
  const { markDirty, markClean, registerSaveHandler } = useUnsavedChanges()

  useEffect(() => {
    loadUser()
  }, [])

  const hasEmailChange = email.trim().toLowerCase() !== currentEmail.toLowerCase()
  const hasPasswordChange = Boolean(currentPassword || newPassword || confirmPassword)

  async function loadUser() {
    setLoading(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage({ type: "error", text: "Kullanıcı bilgisi alınamadı. Lütfen tekrar giriş yapın." })
      setLoading(false)
      return
    }

    setCurrentEmail(user.email || "")
    setEmail(user.email || "")

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single()

    setIsAdmin(profile?.is_admin || false)
    markClean()
    setLoading(false)
  }

  const updateEmail = useCallback(async () => {
    const newEmail = email.trim().toLowerCase()

    if (!newEmail) {
      setMessage({ type: "error", text: "Yeni e-posta adresini girin." })
      return false
    }

    if (newEmail === currentEmail.toLowerCase()) {
      return true
    }

    setEmailSaving(true)
    setMessage(null)

    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    })

    if (error) {
      setMessage({ type: "error", text: `E-posta güncellenemedi: ${error.message}` })
      setEmailSaving(false)
      return false
    }

    setMessage({
      type: "success",
      text: "E-posta güncelleme işlemi başlatıldı. Yeni e-posta adresine gelen doğrulama linkini onaylayın.",
    })
    setEmail(newEmail)
    setEmailSaving(false)
    return true
  }, [email, currentEmail, supabase])

  const updatePassword = useCallback(async () => {
    if (!currentPassword && !newPassword && !confirmPassword) {
      return true
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Tüm şifre alanlarını doldurun." })
      return false
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Yeni şifreler eşleşmiyor." })
      return false
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Yeni şifre en az 6 karakter olmalı." })
      return false
    }

    if (currentPassword === newPassword) {
      setMessage({ type: "error", text: "Yeni şifre mevcut şifreyle aynı olamaz." })
      return false
    }

    setPasswordSaving(true)
    setMessage(null)

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user?.email) {
      setMessage({ type: "error", text: "Kullanıcı bilgisi alınamadı. Lütfen tekrar giriş yapın." })
      setPasswordSaving(false)
      return false
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      setMessage({ type: "error", text: "Mevcut şifre yanlış." })
      setPasswordSaving(false)
      return false
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      setMessage({ type: "error", text: `Şifre güncellenemedi: ${error.message}` })
      setPasswordSaving(false)
      return false
    }

    setMessage({ type: "success", text: "Şifreniz başarıyla güncellendi." })
    await logSecurityEvent("password_change")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordSaving(false)
    return true
  }, [currentPassword, newPassword, confirmPassword, supabase])

  const saveAccountChanges = useCallback(async () => {
    let ok = true

    if (hasEmailChange) {
      ok = await updateEmail()
    }

    if (ok && hasPasswordChange) {
      ok = await updatePassword()
    }

    if (ok) {
      markClean()
      toast.success("Değişiklikler kaydedildi ✅")
    }

    return ok
  }, [hasEmailChange, hasPasswordChange, updateEmail, updatePassword, markClean])

  useEffect(() => {
    registerSaveHandler(saveAccountChanges)
    return () => registerSaveHandler(null)
  }, [registerSaveHandler, saveAccountChanges])

  function handleEmailChange(value: string) {
    setEmail(value)
    if (value.trim().toLowerCase() !== currentEmail.toLowerCase()) {
      markDirty()
    }
  }

  function handleCurrentPasswordChange(value: string) {
    setCurrentPassword(value)
    markDirty()
  }

  function handleNewPasswordChange(value: string) {
    setNewPassword(value)
    markDirty()
  }

  function handleConfirmPasswordChange(value: string) {
    setConfirmPassword(value)
    markDirty()
  }

  async function handleUpdateEmailClick() {
    const ok = await updateEmail()
    if (ok && !hasPasswordChange) {
      markClean()
    }
  }

  async function handleUpdatePasswordClick() {
    const ok = await updatePassword()
    if (ok && !hasEmailChange) {
      markClean()
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Yükleniyor...</div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Hesap Ayarları</h1>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {isAdmin && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <Shield className="w-5 h-5 text-purple-600" />
          <span className="text-purple-800 font-medium">Admin Hesabı</span>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">E-posta Adresi</h2>
              <p className="text-blue-100 text-sm">E-posta adresinizi değiştirin</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label htmlFor="current-email" className="text-muted-foreground text-sm">Mevcut E-posta</Label>
            <div className="flex items-center gap-2 mt-1 p-3 bg-muted/50 rounded-lg">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{currentEmail}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="new-email" className="text-muted-foreground text-sm">Yeni E-posta</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="yeni@email.com"
              className="mt-1 h-11"
            />
          </div>

          <Button
            onClick={handleUpdateEmailClick}
            disabled={emailSaving || email.trim().toLowerCase() === currentEmail.toLowerCase()}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white h-11"
          >
            {emailSaving ? "Kaydediliyor..." : "E-posta Güncelle"}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Şifre Değiştir</h2>
              <p className="text-amber-100 text-sm">Hesap şifrenizi değiştirin</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label htmlFor="current-password" className="text-muted-foreground text-sm">Mevcut Şifre</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => handleCurrentPasswordChange(e.target.value)}
              placeholder="Mevcut şifreniz"
              className="mt-1 h-11"
            />
          </div>

          <div>
            <Label htmlFor="new-password" className="text-muted-foreground text-sm">Yeni Şifre</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => handleNewPasswordChange(e.target.value)}
              placeholder="En az 6 karakter"
              className="mt-1 h-11"
            />
          </div>

          <div>
            <Label htmlFor="confirm-password" className="text-muted-foreground text-sm">Yeni Şifre Tekrar</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              placeholder="Yeni şifrenizi tekrar girin"
              className="mt-1 h-11"
            />
          </div>

          <Button
            onClick={handleUpdatePasswordClick}
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white h-11"
          >
            {passwordSaving ? "Kaydediliyor..." : "Şifre Güncelle"}
          </Button>
        </div>
      </div>
    </div>
  )
}
