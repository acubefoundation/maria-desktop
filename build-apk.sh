#!/bin/bash
# Build a Capacitor Android debug APK using the JDK bundled with Android Studio.
set -euo pipefail

export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

cd "$(dirname "$0")/android"

echo "java:  $($JAVA_HOME/bin/java -version 2>&1 | head -1)"
echo "sdk:   $ANDROID_HOME"
echo "gradle: $(./gradlew --version 2>/dev/null | grep -i '^Gradle' || echo 'resolving...')"
echo

./gradlew assembleDebug --no-daemon "$@"
