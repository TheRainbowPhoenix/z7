import math

def ADP_Decode_Flashing(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   flash: String
    #   decoded: ADP: Decoded: Flash
    #   encoded: ADP: Encoded: Formatting: Flashing
    # VAR_TEMP:
    #   _return: String
    if (context['flash'] == context['encoded'].off):
        context['_return'] = context['decoded'].off
        # GOTO RTRN (Not supported)
    if (context['flash'] == context['encoded'].on):
        context['_return'] = context['decoded'].on
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Flashing'] = context['_return']
