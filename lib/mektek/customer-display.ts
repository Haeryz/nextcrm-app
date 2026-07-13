export const MEKTEK_TIME_ZONE = "Asia/Makassar";

export const formatCustomerDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: MEKTEK_TIME_ZONE,
      }).format(new Date(value))
    : "Belum ditentukan";

export const formatCustomerDateTime = (value: string | null) => {
  if (!value) return "-";

  const date = new Date(value);
  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    timeZone: MEKTEK_TIME_ZONE,
  }).format(date);
  const formattedTime = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: MEKTEK_TIME_ZONE,
  }).format(date);

  return `${formattedDate} - ${formattedTime}`;
};
