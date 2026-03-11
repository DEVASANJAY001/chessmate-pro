import { useState, useEffect } from "react";

export interface MarketStatus {
  isOpen: boolean;
  statusText: string;
  nextOpenTime: string | null;
}

function getISTDate(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

export function useMarketStatus(): MarketStatus {
  const [status, setStatus] = useState<MarketStatus>({ isOpen: false, statusText: "", nextOpenTime: null });

  useEffect(() => {
    const check = () => {
      const ist = getISTDate();
      const day = ist.getDay(); // 0=Sun, 6=Sat
      const hours = ist.getHours();
      const minutes = ist.getMinutes();
      const timeInMinutes = hours * 60 + minutes;

      const marketOpen = 9 * 60; // 9:00 AM
      const marketClose = 15 * 60 + 30; // 3:30 PM

      const isWeekday = day >= 1 && day <= 5;
      const isDuringHours = timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
      const isOpen = isWeekday && isDuringHours;

      let statusText = "";
      let nextOpenTime: string | null = null;

      if (isOpen) {
        const closeH = Math.floor((marketClose - timeInMinutes) / 60);
        const closeM = (marketClose - timeInMinutes) % 60;
        statusText = `Market Open · Closes in ${closeH}h ${closeM}m`;
      } else {
        statusText = "Market Closed";
        // Calculate next open
        const nextDay = new Date(ist);
        if (isWeekday && timeInMinutes < marketOpen) {
          // Today before open
          nextOpenTime = "Today 9:00 AM";
        } else {
          // Find next weekday
          let daysToAdd = 1;
          let checkDay = (day + 1) % 7;
          while (checkDay === 0 || checkDay === 6) {
            daysToAdd++;
            checkDay = (checkDay + 1) % 7;
          }
          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          nextOpenTime = `${dayNames[checkDay]} 9:00 AM`;
        }
        statusText += nextOpenTime ? ` · Opens ${nextOpenTime}` : "";
      }

      setStatus({ isOpen, statusText, nextOpenTime });
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return status;
}
