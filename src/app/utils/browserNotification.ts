// Utility to handle native Browser Desktop Push Notifications
import logoImg from '../../assets/logo.png';

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (e) {
      console.warn("Failed to request notification permission", e);
      return false;
    }
  }

  return false;
};

export const showDesktopNotification = (
  title: string,
  body: string,
  onClick?: () => void,
  customIcon?: string
) => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  try {
    const iconUrl = customIcon || logoImg || (window.location.origin + '/logo.png');

    const notification = new Notification(title, {
      body,
      icon: iconUrl,
      badge: iconUrl,
      tag: `packs-alert-${Date.now()}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      if (onClick) {
        onClick();
      }
      notification.close();
    };
  } catch (error) {
    console.warn("Desktop notification trigger failed:", error);
  }
};
