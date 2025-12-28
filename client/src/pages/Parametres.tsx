import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Parametres() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/dashboard/parametres/general");
  }, [setLocation]);

  return null;
}
