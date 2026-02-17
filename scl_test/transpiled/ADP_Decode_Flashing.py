import math

def ADP_Decode_Flashing(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   flash: String
    #   decoded: ADP: Decoded: Flash
    #   encoded: ADP: Encoded: Formatting: Flashing
    # VAR_TEMP:
    #   _return: String
    if (context['flash'] == context['encoded'].off):
        context['_return'] = context['decoded'].off
        pass # GOTO RTRN (Not supported)
    if (context['flash'] == context['encoded'].on):
        context['_return'] = context['decoded'].on
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Decode: Flashing'] = context['_return']
