import math

def ADP_Decode_Horizontal_Alignment(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   horizontal_alignment: String
    #   decoded: ADP: Decoded: Horizontal Alignment
    #   encoded: ADP: Encoded: Formatting: Horizontal Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['horizontal_alignment'] == context['encoded'].center):
        context['_return'] = context['decoded'].center
        pass # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['encoded'].left):
        context['_return'] = context['decoded'].left
        pass # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['encoded'].right):
        context['_return'] = context['decoded'].right
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Decode: Horizontal Alignment'] = context['_return']
