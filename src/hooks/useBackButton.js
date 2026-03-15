import { useEffect, useRef } from "react";
import { App as CapApp } from "@capacitor/app";

/**
 * Android geri tuşunu yönetir.
 * - 1. basış: scan sayfasına dön
 * - 2. basış (scan'deyken): çıkış onayını göster
 * - 3. basış (onay açıkken): uygulamadan çık
 */
export function useBackButton(setPage, setShowExitConfirm) {
  const pageRef            = useRef("scan");
  const showExitConfirmRef = useRef(false);
  const backPressCountRef  = useRef(0);
  const backPressTimerRef  = useRef(null);

  // Caller her render'da güncel değerleri ref'e yazar
  const syncRefs = (page, showExitConfirm) => {
    pageRef.current            = page;
    showExitConfirmRef.current = showExitConfirm;
  };

  useEffect(() => {
    let listener;

    const handleBackButton = () => {
      if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current);

      backPressCountRef.current += 1;
      const pressCount = backPressCountRef.current;

      backPressTimerRef.current = setTimeout(() => {
        backPressCountRef.current = 0;
        setShowExitConfirm(false);
      }, 2000);

      if (pressCount === 1) {
        if (pageRef.current !== "scan") {
          setPage("scan");
          backPressCountRef.current = 0;
        }
        return;
      }

      if (pressCount === 2 && pageRef.current === "scan") {
        setShowExitConfirm(true);
        return;
      }

      if (pressCount === 3 && pageRef.current === "scan" && showExitConfirmRef.current) {
        CapApp.exitApp();
      }
    };

    CapApp.addListener("backButton", handleBackButton)
      .then(result => { listener = result; })
      .catch(() => {});

    return () => {
      if (listener) listener.remove();
      if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { syncRefs, backPressCountRef };
}
