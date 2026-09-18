let vehicles = [];
let selectedVehicle = null;
let config = null;

async function loadVehicles() {
    const response = await fetch("vehicles/vehicles.json");
    vehicles = await response.json();
}

function createVehicleButtons() {

    const container = document.getElementById("vehicleSelect");

    container.innerHTML = "";

    vehicles.forEach(vehicle => {
        const btn = document.createElement("button");
        const iconContainer = document.createElement("div");
        iconContainer.className = "vehicleIcons";

        vehicle.icons.forEach(icon => {
            const img = document.createElement("img");
            img.src = icon;
            img.className = "vehicleIcon";
            iconContainer.appendChild(img);
        });

        const span = document.createElement("span");
        span.textContent = vehicle.name;

        btn.append(iconContainer, span);

        btn.addEventListener("click", async () => {

            selectedVehicle = vehicle;
            document.getElementById("vehicleSelector").hidden = true;
            document.getElementById("simulator").hidden = false;
            await loadConfig();
            await startVehicle();
            initVehicles();
            setExplanation();
            if (config.hasReferenceSite) {
                setReferenceSite();
            } else {
                document.getElementById("referenceSite").hidden = true;
            }
        });
        container.appendChild(btn);
    });
}

async function initVehicles() {
    await loadVehicles();
    createVehicleButtons();
}

initVehicles();