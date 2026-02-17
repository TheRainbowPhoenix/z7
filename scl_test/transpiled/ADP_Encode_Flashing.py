import math

def ADP_Encode_Flashing(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   flash: String
    #   encoded: ADP: Encoded: Formatting: Flashing
    #   decoded: ADP: Decoded: Flash
    # VAR_TEMP:
    #   _return: String
    if (context['flash'] == context['decoded'].off):
        context['_return'] = context['encoded'].off
        pass # GOTO RTRN (Not supported)
    if (context['flash'] == context['decoded'].on):
        context['_return'] = context['encoded'].on
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Flashing'] = context['_return']
