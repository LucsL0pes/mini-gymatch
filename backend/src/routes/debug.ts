import { Router } from "express";
import { supabase } from "../services/db";

export const debugRouter = Router();


debugRouter.get("/env", (_req, res) => {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    KEY_SUFFIX: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-6),
  });
});

debugRouter.get("/find/:token", async (req, res) => {
  const token = (req.params.token || "").trim();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, auth_token, gender, show_me")
    .eq("auth_token", token)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ found: !!data, data });
});
