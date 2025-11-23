 {
     "targets": [
       {
         "target_name": "zlgcan",
         "sources": [
           "src/zlgcan/zlgcan_wrapper.cpp"
         ],
         "include_dirs": [
           "<!@(node -p \"require('node-addon-api').include\")",
           "src/zlgcan/include"
         ],
         "libraries": [
           "src/zlgcan/lib/zlgcan.lib"
         ],
         "defines": [
           "NAPI_CPP_EXCEPTIONS"
         ],
        "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
        }
       }
     ]
   }