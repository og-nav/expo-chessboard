import { forwardRef } from "react";
import { ScrollView, ScrollViewProps } from "react-native";

/**
 * Scroll view configured to play nicely with the iOS large-title /
 * transparent header / blur tab bar combo. `contentInsetAdjustmentBehavior=
 * "automatic"` is what tells iOS to push the content under the
 * collapsing header AND under the bottom blur tab bar without us
 * computing the inset by hand.
 */
export const BodyScrollView = forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => {
    return (
      <ScrollView
        ref={ref}
        automaticallyAdjustsScrollIndicatorInsets
        contentInsetAdjustmentBehavior="automatic"
        contentInset={{ bottom: 0 }}
        scrollIndicatorInsets={{ bottom: 0 }}
        {...props}
      />
    );
  }
);
BodyScrollView.displayName = "BodyScrollView";
