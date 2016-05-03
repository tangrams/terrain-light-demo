/*jslint browser: true*/
/*global Tangram, gui */

(function () {
    'use strict';

    var map_start_location = [37.9258, -121.9543, 12]; // NYC

    /*** URL parsing ***/

    // leaflet-style URL hash pattern:
    // #[zoom],[lat],[lng]
    var url_hash = window.location.hash.slice(1, window.location.hash.length).split('/');

    if (url_hash.length == 3) {
        map_start_location = [url_hash[1],url_hash[2], url_hash[0]];
        // convert from strings
        map_start_location = map_start_location.map(Number);
    }

    /*** Map ***/

    var map = L.map('map',
        {'keyboardZoomOffset': .05}
    );


    var layer = Tangram.leafletLayer({
        scene: 'scene.yaml',
        preUpdate: preUpdate,
        attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>'
    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    map.setView(map_start_location.slice(0, 2), map_start_location[2]);

    var hash = new L.Hash(map);
    
    // Resize map to window
    function resizeMap() {
        document.getElementById('map').style.width = window.innerWidth + 'px';
        document.getElementById('map').style.height = window.innerHeight + 'px';
        map.invalidateSize(false);
    }

    window.addEventListener('resize', resizeMap);
    resizeMap();

    function controllerByName(which) {
        for (var i = 0; i < gui.__controllers.length; i++) {
            if (gui.__controllers[i].property == which) {
                return gui.__controllers[i];
            }
        }
    }

    // GUI options for rendering modes/effects
    var controls = {
        'RESET ALL' : function() {
            window.location.reload();
        },
        'Directional' : function() {
            setLight("directional");
        },
        'direction_x' : 0.1,
        'direction_y' : .9,
        'direction_z' : .1,
        'direction_toggle' : false,
        'direction_diffuse' : '#00ffff',
        'Point' : function() {
            setLight("point");
        },
        'point_x' : 0,
        'point_y' : 0,
        'point_z' : 150,
        'point_toggle' : false,
        'point_diffuse' : '#ff0000',

        'scale' : 1,
        'DEMO' : false
    };
    var directional_mouse = false;
    var point_mouse = false;
    var demo_mode = false;

    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
    function rgbToHex(c) {
        var r = c[0] * 256;
        var g = c[1] * 256;
        var b = c[2] * 256;
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16) / 256,
            parseInt(result[2], 16) / 256,
            parseInt(result[3], 16) / 256,
            1
        ] : null;
    }

    // Create dat GUI
    var gui = new dat.GUI({ autoPlace: true, width: 300 });
    function addGUI () {
        gui.domElement.parentNode.style.zIndex = 500;
        window.gui = gui;

        // LIGHTS
        gui.add(controls, 'RESET ALL');
        gui.add(controls, 'Directional').name("Directional Light:");
        gui.add(controls, 'direction_x', -1.0, 1.0).name("&nbsp;&nbsp;direction x").onChange(function(value) {
            scene.lights.light1.direction[0] = value;
            scene.requestRedraw();
        });
        gui.add(controls, 'direction_y', -1.0, 1.0).name("&nbsp;&nbsp;direction y").onChange(function(value) {
            scene.lights.light1.direction[1] = value;
            scene.requestRedraw();
        });
        gui.add(controls, 'direction_z', -1.0, 0.0).name("&nbsp;&nbsp;direction z").onChange(function(value) {
            scene.lights.light1.direction[2] = value;
            scene.requestRedraw();
        });
        gui.add(controls, 'direction_toggle').name("&nbsp;&nbsp;mouse control").onChange(function(value) {
            directional_mouse = value;
        });
        gui.addColor(controls, 'direction_diffuse').name("&nbsp;&nbsp;diffuse").onChange(function(value) {
            scene.lights.light1.diffuse = hexToRgb(value);
            scene.requestRedraw();
        });
        gui.add(controls, 'Point').name("Point Light:");
        gui.add(controls, 'point_x', -1000, 1000).name("&nbsp;&nbsp;point x").onChange(function(value) {
            scene.lights.light2.position[0] = value+"px";
            scene.requestRedraw();
        });
        gui.add(controls, 'point_y', -1000, 1000).name("&nbsp;&nbsp;point y").onChange(function(value) {
            scene.lights.light2.position[1] = value+"px";
            scene.requestRedraw();
        });
        gui.add(controls, 'point_z', 0, 500).name("&nbsp;&nbsp;point z").onChange(function(value) {
            scene.lights.light2.position[2] = value+"px";
            scene.requestRedraw();
        });
        gui.add(controls, 'point_toggle').name("&nbsp;&nbsp;mouse control").onChange(function(value) {
            point_mouse = value;
        });
        gui.addColor(controls, 'point_diffuse', 0, 2).name("&nbsp;&nbsp;diffuse").onChange(function(value) {
            scene.lights.light2.diffuse = hexToRgb(value);
            console.log(hexToRgb(value))
            scene.requestRedraw();
        });
        gui.add(controls, 'scale', 0, 10).name("terrain scale").onChange(function(value) {
            scene.styles.terrain.shaders.uniforms.u_scale = value;
            scene.requestRedraw();
        });
        gui.add(controls, 'DEMO').name("DEMO").onChange(function(value) {
            demo_mode = value;
        });
    }


    // mouse position listener

    var mouse_monitor = function(e) {
        var height = document.body.clientHeight;
        var width = document.body.clientWidth;

        var x = e.clientX;
        var y = e.clientY;
        var xpos = ((x - (width / 2)));
        var ypos = ((y - (height / 2)))*-1.;
        var xpercent = x/width * 2. - 1.;
        var ypercent = y/height * 2. - 1.;

        if (directional_mouse) {
            scene.lights.light1.direction = [xpercent,ypercent*-1,scene.lights.light1.direction[2]];
            gui.__controllers[2].setValue(scene.lights.light1.direction[0]);
            gui.__controllers[3].setValue(scene.lights.light1.direction[1]);
            scene.requestRedraw();
        }
        if (point_mouse) {
            // debugger;
            scene.lights.light2.position = [xpos,ypos,scene.lights.light2.position[2]];
            gui.__controllers[8].setValue(scene.lights.light2.position[0]);
            gui.__controllers[9].setValue(scene.lights.light2.position[1]);
            scene.requestRedraw();
        }

    }

    window.onload = function() {
      this.addEventListener('mousemove', mouse_monitor);
    }

    /***** Render loop *****/
    window.addEventListener('load', function () {
        // Scene initialized
        layer.on('init', function() {
            addGUI();
        });
        layer.addTo(map);
    });

    function preUpdate(will_render) {
        if (!will_render) {
            return;
        }

        switch(demo_mode) {
            case true:
                daycycle();
                break;
        }
    }

    function daycycle() {
        var d = new Date();
        var t = d.getTime()/1000;

        var x = Math.sin(t);
        var y = Math.sin(t+(3.14159/2)); // 1/4 offset
        var z = Math.sin(t+(3.14159)); // 1/2 offset

        // scene.lights.light1.direction = [x, y, -.5];
        var G = y;
        
        // offset blue and red for sunset and moonlight effect
        var B = x + Math.abs(Math.sin(t+(3.14159*.5)))/4;
        var R = y + Math.abs(Math.sin(t*2))/4;
        R = Math.max(Math.min(R, 1.), 0);
        G = Math.max(Math.min(G, 1.), 0);
        B = Math.max(Math.min(B, 1.), 0);

        var color = [R, G, B, 1];
        var direction = [x, y, -.5];
        scene.lights.light1.diffuse = color;
        console.log(color, '=>', rgbToHex(color))
        controls.direction_diffuse = toString(rgbToHex(color));
        controls.direction_x = x;
        controls.direction_y = y;
        scene.lights.light1.direction = [x, y, -.5];

        // Iterate over all controllers
        for (var i in gui.__controllers) {
            gui.__controllers[i].updateDisplay();
        }
    }



}());
