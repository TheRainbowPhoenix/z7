import math

def ADP_Encode_Flashing(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   flash: String
    #   encoded: ADP: Encoded: Formatting: Flashing
    #   decoded: ADP: Decoded: Flash
    # VAR_TEMP:
    #   _return: String
    if (context['flash'] == context['decoded'].off):
        context['_return'] = context['encoded'].off
        # GOTO RTRN (Not supported)
    if (context['flash'] == context['decoded'].on):
        context['_return'] = context['encoded'].on
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Flashing'] = context['_return']
