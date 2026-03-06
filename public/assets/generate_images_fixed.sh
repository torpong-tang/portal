#!/bin/bash
cd /home/johnson/projects/portal/public/assets

download_image() {
    local prompt=$1
    local output=$2
    local width=${3:-1200}
    local height=${4:-800}
    
    local encoded_prompt="${prompt// /%20}"
    local url="https://image.pollinations.ai/prompt/${encoded_prompt}?width=${width}&height=${height}&model=flux-realism&nologo=true"
    
    echo "Generating $output..."
    curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "$url" -o "$output"
    
    # Check if failed with cloudflare block
    if grep -q "error code:" "$output" 2>/dev/null; then
        echo "Failed to generate $output. CloudFlare block detected."
    else
        echo "Success: $output"
    fi
}

mkdir -p covers

download_image "A stunning modern beautiful background depicting IT Network hardware Cloud computing glowing data streams server racks dark theme high tech abstract cinematic lighting" "bg.jpg" 1920 1080
download_image "Beautiful modern timesheet concept high tech digital and glowing analog clock faces futuristic time management dark theme elegant aesthetics" "covers/timesheet.jpg"
download_image "A luxurious modern beautiful meeting room high tech glass table floor to ceiling windows city view dark elegant aesthetics warm glowing lights futuristic premium" "covers/roomie.jpg"
download_image "Modern high tech software and hardware quality inspection tools testing dashboard glowing circuits analytical displays beautiful dark theme premium tech aesthetic" "covers/tika.jpg"
download_image "Modern high tech project management data visualization floating gantt charts glowing project timelines abstract network connections beautiful dark theme premium interface" "covers/easypro.jpg"
download_image "Modern beautiful Knowledge Management concept glowing interconnected neural nodes glowing digital brain network abstract data library dark theme elegant high tech" "covers/kmiso.jpg"
download_image "Modern beautiful cracked earth and volcano highly detailed glowing magma seeping through cracks cinematic lighting impressive dark theme background" "covers/eqinfo.jpg"

echo "Done"
