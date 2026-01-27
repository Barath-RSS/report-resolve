// Edge function to send 6-digit OTP code for password reset
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
const Resend = (await import("https://esm.sh/resend@2.0.0")).Resend;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!url || !serviceKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const resend = new Resend(resendApiKey);

    // Check if user exists in profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
    }

    // Even if user doesn't exist, we don't reveal that for security
    // Generate and send code anyway (won't work for non-existent users)
    
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Invalidate any existing codes for this email
    await supabase
      .from("password_reset_codes")
      .update({ used: true })
      .eq("email", email.toLowerCase())
      .eq("used", false);

    // Store new code
    const { error: insertError } = await supabase
      .from("password_reset_codes")
      .insert({
        email: email.toLowerCase(),
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate reset code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email with Resend
    const { error: emailError } = await resend.emails.send({
      from: "Campus Connect <onboarding@resend.dev>",
      to: [email],
      subject: "Password Reset Code - Campus Connect",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #7c1d3e 0%, #5c1530 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Campus Connect</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 14px;">Password Reset Request</p>
            </div>
            <div style="padding: 32px 24px;">
              <p style="color: #333; font-size: 16px; margin: 0 0 16px 0;">Hello${profile?.full_name ? ` ${profile.full_name}` : ''},</p>
              <p style="color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                You requested to reset your password. Use the code below to verify your identity:
              </p>
              <div style="background: linear-gradient(135deg, #f8f4f5 0%, #fdf9fa 100%); border: 2px solid #e8d4d9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <p style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px 0;">Your Verification Code</p>
                <p style="color: #7c1d3e; font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: monospace;">${code}</p>
              </div>
              <p style="color: #999; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                ⏱️ This code expires in <strong>10 minutes</strong>.
              </p>
              <p style="color: #999; font-size: 13px; line-height: 1.5; margin: 0;">
                If you didn't request this, please ignore this email. Your password will remain unchanged.
              </p>
            </div>
            <div style="background: #f8f9fa; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Campus Connect - Sathyabama University</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`OTP sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Send OTP error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
